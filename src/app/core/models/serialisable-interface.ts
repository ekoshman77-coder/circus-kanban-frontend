export interface Serializable<T> {
  toJson(): T;
}

export interface Deserializable<T, U extends Serializable<T>> {
  fromJson(json: T): U;
}