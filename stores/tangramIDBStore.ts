import type { UseStore } from 'idb-keyval';

import { createStore } from 'idb-keyval';

// 创建自定义的 tangram IndexedDB store
export const tangramIDBStore: UseStore = createStore('tangram-db', 'tangram-store');
