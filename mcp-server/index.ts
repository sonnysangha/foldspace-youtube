import {
  authServerMetadataHandlerClerk,
  protectedResourceHandlerClerk,
  streamableHttpHandler,
} from '@clerk/mcp-tools/express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { assertConfigured, callFoldspace } from './lib/foldspace.ts'
import {
  getUserProfile,
  MCP_RESOURCE_URL,
  PORT,
  REQUIRED_SCOPES,
  RESOURCE_METADATA_PATH,
  RESOURCE_METADATA_URL,
  verifyMcpToken,
} from './lib/mcp-auth.ts'

assertConfigured()
console.info('Foldspace MCP runtime', process.version)

const app = express()
app.use(cors({ exposedHeaders: ['WWW-Authenticate'] }))
app.use(express.json())

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'foldspace-mcp' })
})

const NOTE_COLORS = ['#FFF3B0', '#FFD6E0', '#D7F9E9', '#DCEBFF', '#EADCFF']
const position = {
  x: z.number().optional().describe('Left edge on the canvas. Omit to place automatically.'),
  y: z.number().optional().describe('Top edge on the canvas. Omit to place automatically.'),
}
const taskInput = z.object({
  text: z.string(),
  done: z.boolean().optional(),
})

type Extra = { authInfo?: { extra?: Record<string, unknown> } }

/** The Clerk user the verified OAuth token belongs to. Never taken from tool input. */
function userIdFrom(extra: Extra) {
  const userId = extra.authInfo?.extra?.userId
  if (typeof userId !== 'string') throw new Error('Missing authenticated user')
  return userId
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

function withIds(tasks: z.infer<typeof taskInput>[]) {
  return tasks.map((task, index) => ({
    id: `${Date.now().toString(36)}-${index}`,
    text: task.text,
    done: task.done ?? false,
  }))
}

// Each request gets its own MCP server, as in the Clerk guide.
function createServer() {
  const server = new McpServer({ name: 'foldspace', version: '1.0.0' })

  server.registerTool(
    'whoami',
    { description: 'Shows which Foldspace user this connection is acting for.' },
    async (extra) => text(await getUserProfile(userIdFrom(extra))),
  )

  server.registerTool(
    'list_spaces',
    {
      description:
        'Lists every space the user owns. Spaces nest: parentId is null for top-level spaces, otherwise the id of the space whose canvas it sits on.',
    },
    async (extra) => text(await callFoldspace(userIdFrom(extra), 'list_spaces')),
  )

  server.registerTool(
    'get_space',
    {
      description:
        'Gets one space with everything on its canvas: notes, to-do lists and nested spaces, with their ids and positions.',
      inputSchema: { spaceId: z.string() },
    },
    async ({ spaceId }, extra) => text(await callFoldspace(userIdFrom(extra), 'get_space', { spaceId })),
  )

  server.registerTool(
    'create_space',
    {
      description:
        'Creates a space. Pass parentSpaceId to nest it inside another space, where it appears as a card on that canvas. Returns the new space id.',
      inputSchema: {
        name: z.string(),
        parentSpaceId: z.string().optional(),
        color: z.string().optional().describe('Hex colour such as #6C5CE7'),
        ...position,
      },
    },
    async ({ name, parentSpaceId, color, x, y }, extra) =>
      text({
        spaceId: await callFoldspace(userIdFrom(extra), 'create_space', {
          name,
          parentId: parentSpaceId,
          color,
          x,
          y,
        }),
      }),
  )

  server.registerTool(
    'rename_space',
    {
      description: 'Renames a space or changes its colour.',
      inputSchema: { spaceId: z.string(), name: z.string().optional(), color: z.string().optional() },
    },
    async (args, extra) => {
      await callFoldspace(userIdFrom(extra), 'update_space', args)
      return text({ ok: true })
    },
  )

  server.registerTool(
    'delete_space',
    {
      description:
        'Permanently deletes a space and everything inside it, including nested spaces. Confirm with the user first.',
      inputSchema: { spaceId: z.string() },
    },
    async ({ spaceId }, extra) => {
      await callFoldspace(userIdFrom(extra), 'delete_space', { spaceId })
      return text({ ok: true })
    },
  )

  server.registerTool(
    'add_note',
    {
      description: 'Adds a sticky note to a space. Returns the new item id.',
      inputSchema: {
        spaceId: z.string(),
        text: z.string(),
        color: z.enum(NOTE_COLORS as [string, ...string[]]).optional(),
        ...position,
      },
    },
    async ({ spaceId, text: body, color, x, y }, extra) =>
      text({
        itemId: await callFoldspace(userIdFrom(extra), 'create_item', {
          spaceId,
          x,
          y,
          content: { kind: 'note', text: body, color: color ?? NOTE_COLORS[0] },
        }),
      }),
  )

  server.registerTool(
    'add_todo_list',
    {
      description: 'Adds a to-do list to a space. Returns the new item id.',
      inputSchema: {
        spaceId: z.string(),
        title: z.string(),
        tasks: z.array(taskInput).max(50),
        ...position,
      },
    },
    async ({ spaceId, title, tasks, x, y }, extra) =>
      text({
        itemId: await callFoldspace(userIdFrom(extra), 'create_item', {
          spaceId,
          x,
          y,
          content: { kind: 'todo', title, tasks: withIds(tasks) },
        }),
      }),
  )

  server.registerTool(
    'update_note',
    {
      description:
        'Replaces the text and colour of a note. Pass the current colour to keep it; omitting it resets the note to yellow.',
      inputSchema: {
        itemId: z.string(),
        text: z.string(),
        color: z.enum(NOTE_COLORS as [string, ...string[]]).optional(),
      },
    },
    async ({ itemId, text: body, color }, extra) => {
      await callFoldspace(userIdFrom(extra), 'update_item', {
        itemId,
        content: { kind: 'note', text: body, color: color ?? NOTE_COLORS[0] },
      })
      return text({ ok: true })
    },
  )

  server.registerTool(
    'update_todo_list',
    {
      description:
        'Replaces a to-do list: its title and its full set of tasks. Use get_space first to read the current tasks, then send the complete new list.',
      inputSchema: { itemId: z.string(), title: z.string(), tasks: z.array(taskInput).max(50) },
    },
    async ({ itemId, title, tasks }, extra) => {
      await callFoldspace(userIdFrom(extra), 'update_item', {
        itemId,
        content: { kind: 'todo', title, tasks: withIds(tasks) },
      })
      return text({ ok: true })
    },
  )

  server.registerTool(
    'move_item',
    {
      description: 'Moves a card (note, to-do list or nested space) to a new position on its canvas.',
      inputSchema: { itemId: z.string(), x: z.number(), y: z.number() },
    },
    async (args, extra) => {
      await callFoldspace(userIdFrom(extra), 'update_item', args)
      return text({ ok: true })
    },
  )

  server.registerTool(
    'delete_item',
    {
      description:
        'Deletes a card from a canvas. Deleting a nested-space card also deletes that space and its contents.',
      inputSchema: { itemId: z.string() },
    },
    async ({ itemId }, extra) => {
      await callFoldspace(userIdFrom(extra), 'delete_item', { itemId })
      return text({ ok: true })
    },
  )

  return server
}

app.post('/mcp', async (req, res) => {
  const authorization = req.get('authorization') ?? ''
  const challenge = `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`
  if (!/^Bearer \S+$/i.test(authorization)) {
    // No credentials: point the client at the metadata so it can start sign-in.
    res.status(401).set('WWW-Authenticate', challenge).json({ error: 'unauthorized' })
    return
  }
  const authInfo = await verifyMcpToken(new Request(MCP_RESOURCE_URL, { headers: { authorization } }))
  if (!authInfo) {
    res
      .status(401)
      .set('WWW-Authenticate', `${challenge}, error="invalid_token"`)
      .json({ error: 'invalid_token' })
    return
  }
  if (!REQUIRED_SCOPES.every((scope) => authInfo.scopes.includes(scope))) {
    res
      .status(403)
      .set(
        'WWW-Authenticate',
        `${challenge}, error="insufficient_scope", scope="${REQUIRED_SCOPES.join(' ')}"`,
      )
      .json({ error: 'insufficient_scope' })
    return
  }

  Object.assign(req, { auth: authInfo })
  await streamableHttpHandler(createServer)(req, res)
})
app.all('/mcp', (_, res) => {
  res.status(405).set('Allow', 'POST, OPTIONS').json({ error: 'method_not_allowed' })
})
// Public OAuth metadata so MCP clients can discover how to sign the user in.
app.get(
  RESOURCE_METADATA_PATH,
  protectedResourceHandlerClerk({
    resource: MCP_RESOURCE_URL,
    scopes_supported: REQUIRED_SCOPES,
  }),
)
app.get('/.well-known/oauth-authorization-server', authServerMetadataHandlerClerk)

export default app

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Foldspace MCP server listening at ${MCP_RESOURCE_URL}`)
  })
}
