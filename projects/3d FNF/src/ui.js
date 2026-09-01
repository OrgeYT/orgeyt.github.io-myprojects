/* src/ui.js
   Tombstones: this file was split into smaller modules to improve maintainability.
   retained as a thin delegator to the new UI module so imports elsewhere need no change.

   Tombstones for removed logic (now moved to src/ui/ui_main.js and src/ui/chooser.js):
   // removed function showJudgment() {}
   // removed function updateHUD() {}
   // removed function resetCombo() {}
   // removed function createChooser() {}
   // removed function wireUI() {}
*/
export { default } from './ui/ui_main.js';