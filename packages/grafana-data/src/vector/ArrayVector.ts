import { MutableVector } from '../types/vector';

// WIP polyfill for replacing ArrayVector() with a plain array
// https://jsfiddle.net/Lbj7co84/
// TODO: typings kung fu

declare global {
  interface Array<T> {
    /** @deprecated used to migrate Vector to array */
    get buffer(): T[];
    /** @deprecated used to migrate Vector to array */
    set buffer(value: T[]);
    /** @deprecated used to migrate Vector to array */
    get(idx: number): T;
    /** @deprecated used to migrate Vector to array */
    set(idx: number, value: T): void;
    /** @deprecated used to migrate Vector to array */
    add(value: T): void;
    /** @deprecated used to migrate Vector to array */
    toArray(): T[];
    /** @deprecated used to migrate Vector to array */
    toJSON(): T[];
  }
}

// JS original sin
Object.assign(Array.prototype, {
  get buffer() {
    return this as any;
  },
  set buffer(values: T[]) {
    (this as any).length = 0;
    (this as any).push(...values);
  },

  get(idx: number): any {
    return (this as any)[idx];
  },
  set(idx: number, value: any) {
    (this as any)[idx] = value;
  },
  add(value: any) {
    (this as any).push(value);
  },
  toArray() {
    return this;
  },
});

/**
 * @public
 *
 * @deprecated use a simple Array<T>
 */
export class ArrayVector<T = any> extends Array<T> implements MutableVector<T> {
  constructor(buffer: T[] = []) {
    super();
    return buffer as ArrayVector<T>;
  }
}

/*
let arv = new ArrayVector([12, 13, 14]);

console.log(arv);
console.log(arv.get(0));
console.log(arv.buffer);
console.log(Array.isArray(arv));
console.log(arv.slice());
*/
