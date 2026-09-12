/* Re-export surface used by the headless smoke test (smoke.mjs). */
export {default as App} from './App.jsx';
export {store,useApp,DEF,hydrate,SCHEMA_VERSION} from './state/store.js';
export {buildLayers} from './core/layers.js';
export {THEMES,shuffleInto} from './state/themes.js';
export {pickPart,geoOf,caseOf,lugToLugOf} from './core/geometry.js';
export {VARIANTS} from './core/parts.js';
export {getThumb,getProc} from './core/cache.js';
export {C,CAN} from './core/constants.js';
export {clone,mk} from './core/utils.js';
export {SaveModal,ProjectsModal} from './ui/Modals.jsx';
export {exportSpec} from './export/spec.js';
export {exportProjectFile} from './export/projectFile.js';
