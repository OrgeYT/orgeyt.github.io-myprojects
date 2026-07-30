/* src/notes.js
   Aggregator module: re-exports split notes functionality from three files.
*/
import * as Core from './notes_core.js';
import { spawnNote } from './notes_spawn.js';
import { updateNotes } from './notes_update.js';

export default {
  generateRandomChart: Core.generateRandomChart,
  parsePsychChart: Core.parsePsychChart,
  clearAll: Core.clearAll,
  spawnNote,
  updateNotes,
  handlePlayerInput: Core.handlePlayerInput
};