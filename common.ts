// common.ts includes core common dependency-free definitions.


/**
 * Listener function parameters received by all treevent listeners.
 * @param path Array of path keys for the context of the event (e.g. ['key', 0, 'prop']).
 * @param params Any value parsed out of ${value} segments in a path, including '**'.
 * @param type Type of update (create, update, delete, or splice).
 * @param index For splice updates, the position of the splice.
 * @param oldValue The previous value, now changed (undefined for creates, and the removed array for splices).
 * @param newValue The new value now at the path (undefined for deletes, the inserted array for splices).
 */ 
export type Listener = (path: Array<string>, params: any, type: string, index: number, oldValue: any, newValue: any) => any;

/**
 * Determins whether an object can have Symbols (and hence metadata and listeners) attached.
 */
export function canTrack(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  value[symbolTest] = true;
  return value[symbolTest] === true;
}
const symbolTest = Symbol('test');

/** 
 * Typescript convenience method.
 * Used to convert Meta supercclasses to the correct subclass, probably a better way to do this.
 */
export function cast<T>(instance, ctor: { new(...args: any[]): T }): T {
    if (instance instanceof ctor) return instance;
    throw new Error('type cast exception');
}
