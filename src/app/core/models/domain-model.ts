export interface DomainModel< T > {
  id: string;
  toJson(): any;
  cloneWith(changes: Partial< T >): T;
}

export interface DomainModelStatic< T extends DomainModel< T > > {
  new (...args: any[]): T;
  fromJson(json: any): T;
}