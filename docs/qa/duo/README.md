# iPhone Duo verification

13 November 2026. Expo SDK 58. Native app changes are local working-tree changes; the MCP endpoint is separately deployed.

## Final navigation

- Expo Router `NativeTabs` with Spaces and Account, each containing a native Stack.
- `preferredPlacement="tabBar"` and `sidebarAdaptable={false}`: native tab bar/rail only, no sidebar panel or SplitView.
- Existing `/`, `/space/[id]`, `/new-space`, and `/item/[id]` URLs retained through route groups.
- iOS add/delete actions use native `Stack.Toolbar.Button` controls.
- The grid measures its available width and respects both horizontal safe-area insets. Canvas controls also stay clear of the rail.

## Reproduced and fixed

1. Home cards rendered as white text without backgrounds or dimensions. `Link asChild` merged away the child Pressable's function-valued style. The style callback now belongs to an inner View.
2. Returning home left the native header stuck with a Back button. Local device logs showed unbalanced appearance transitions in Clerk's native inline UserButton hosted inside the navigation bar. Moving it to Account screen content restored normal navigation; the warning did not recur in the retest.
3. Sheet headers overlapped the native presentation. New-space and item sheets now hide the redundant header.
4. Duo's rail covered interactive content. Horizontal safe-area handling and native toolbar controls keep that content clear.

## Evidence and limits

- Local iPhone Duo: iOS 27.2, current JS via Metro port 8094. App left running for inspection.
- Expo cloud iPhone Duo: iOS 27.1. See [cloud baseline and follow-up checks](cloud-baseline.md).
- Local creation, open/back, folded note editing, and unfolding with the same note were observed. Native-tabs final screenshot shows the side panel removed.
- App lint, TypeScript, and 8 Convex ownership tests pass. MCP server TypeScript also passes.
- Convex dev queries returned successfully during the blank-screen reproduction. Clerk logs showed active sessions with no corresponding auth failure. The issue was not fixed by changing authentication credentials or the database.
- [Native device log summary](local-native-diagnostics.txt) includes the relevant warning and retest comparison. Raw credential-bearing provider logs were not committed.

Earlier screenshots are retained as before/after evidence; screenshots showing a sidebar are not the final navigation design.
