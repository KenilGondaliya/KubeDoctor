import { EventEmitter } from 'events';

export const kubernetesEventBus = new EventEmitter();

kubernetesEventBus.setMaxListeners(100);   