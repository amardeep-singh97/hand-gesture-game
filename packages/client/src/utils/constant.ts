/* --------------------------------------------------------------------------
 * MediaPipe loader
 * The original loaded these via <script> tags in index.html. To keep the
 * component self-contained, we inject them on first mount.
 * -------------------------------------------------------------------------- */
export const MEDIAPIPE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
] as const;
