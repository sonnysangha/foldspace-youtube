# Expo cloud iPhone Duo QA

Session: https://expo.dev/accounts/ssssangha/projects/foldspace-youtube/simulator-sessions/01a1d45c-c94d-7e05-8712-b4cc53e28d1d

Device confirmed by remote inventory: iPhone Duo, iOS 27.1, UDID `74195B53-4DBC-4EAA-9991-F98E5BB86BA8`. The default iOS image does not contain Duo; this session was explicitly created with `--device 'iPhone Duo'`. An initial default-image discovery session was stopped.

App: local Debug native client, connected to current workspace JavaScript using the Expo account-signed Metro tunnel on port 8093. Dev backend: fantastic-bullfrog-823, with authenticated image upload deployed by the parent agent. Remote controller session state is under `/Users/expo/`, confirming cloud use. Testing used the existing Clerk test account and fictional spaces `Duo cloud QA`, `Duo clean QA`, and `Duo verified`.

## Baseline findings and retest

- Clerk email/password/new-device verification succeeded using the development test account. No credentials are included here.
- The original invisible-card problem was fixed before the first cloud Home capture. Coloured cards are visible and open a canvas.
- `cloud-home-before-insets.png`: the Duo rail overlaps the right edge of the home cards before horizontal safe-inset changes.
- `cloud-stale-header.png`: after a cold app relaunch, creating a space returned to Home content with its native header missing and a stale rail Back button. This reproduced independently of Fast Refresh.
- Moving native Clerk UserButton from the navigation header into the Home account row fixed that transition. After another cold relaunch, both open-space → Back and new-space → Create returned to the correct Spaces header, New space button, and Account row, without a stale Back button.
- The moved Account button opened the native account sheet; Close returned to Home with its navigation intact.
- Horizontal safe-inset changes keep the six-button canvas toolbar before the rail; `cloud-canvas-insets-fixed.png` shows the result.
- Half-open posture succeeded: controller reported hinge 130 degrees. `cloud-half-open-baseline.png` is 951×669 and shows the pre-native-sidebar implementation with a 280pt custom sidebar. It responds to wider geometry, but has no explicit hinge-aware two-pane behavior.

## Evidence boundaries

The first image-picker selection was interrupted by Fast Refresh when native navigation work changed the root layout. It returned to the new native sidebar Home, so that attempt is not counted as a successful upload. Drawing, image upload/delete, and latest native navigation retests are pending at this checkpoint. Earlier screenshots are intentionally retained as baseline/fix evidence and should not be described as the final native-sidebar design.

Controller note: `agent-device back` and an exact `BackButton` selector did not trigger the Duo system rail back action. An EAS direct tap at the observed rail button position did, and correctly returned Home after the fix. This was a controller limitation, not evidence that the UI back button was broken after the fix.

## Later feature check during native-navigation work

A cold reload of the temporary native SplitView prototype allowed a new test of the authenticated image flow. The stock Photos flower image uploaded and rendered in the fictional Home Reno 2027 space (`cloud-image-upload.png`), proving the deployed HTTP upload/authentication path works on the Duo. Its Delete image confirmation was opened and the Delete action dispatched; the subsequent root reload for the NativeTabs refactor prevented an independent visual check of final removal at that moment. This temporary SplitView design is superseded by the user's NativeTabs direction and is not final UI evidence.

## Final NativeTabs revision (no side panel)

The final user direction supersedes both sidebar prototypes. A cold app relaunch loaded NativeTabs with tab-bar placement and sidebar adaptation disabled.

Verified on the cloud iPhone Duo:

- Half-open (130 degrees): no side panel. Spaces grid uses the available width, native Spaces/Account controls occupy the system rail, and New space is a native rail action. `cloud-final-half.png` includes a transient development Refreshing banner.
- Fully folded (0 degrees): no side panel. The native rail retains navigation and actions; the six canvas tools fit before the rail. `cloud-final-closed.png`.
- Fully open (180 degrees): no side panel. The same workspace, uploaded image, and saved note remain visible; native rail includes Back, Delete space, and the tabs. `cloud-final-open.png`.
- Created a purple freehand stroke in the half-open canvas, saw it rendered, then Undo removed it (Drawing disappeared from accessibility). `cloud-final-drawing.png` shows the stroke before Undo.
- Added a note, opened its editor, typed `Duo QA note`, and saved. The note persists through folded and fully open transitions.
- The uploaded image is present in the same `Duo verified` workspace after reopening and pose changes, confirming upload persistence.

Remaining limits: Account-tab activation was verified on the intermediate NativeTabs sidebar placement, not repeated after the final placement-only change. Root-space creation/header roundtrip was verified after UserButton relocation but before the final tab-bar placement. Nested-space creation, to-do editing, pan/pinch behavior, image dragging/deletion, large-text layout, and simultaneous fold/draw cancellation were not completed on the final revision. The initial Delete image action occurred during a navigation refactor and is not counted as verified deletion. These are not reported as passing.

## Cleanup

Cloud session 01a1d45c-c94d-7e05-8712-b4cc53e28d1d was explicitly stopped. Owned Metro8093 was stopped and the simulator dotenv reset. The agent-device recording download failed during export (daemon gateway response); the Expo session page is the source for the full-session recording. Screenshots listed above were downloaded successfully.
