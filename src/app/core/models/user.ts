import { IUserJSON } from "../repositories/dto/user-json";

export interface IUserInit {
  id: string;
  username: string;
}

export class User implements IUserJSON {
  public id: string;
  public username: string;

  constructor(init: IUserInit) {
    this.id = init.id;
    this.username = init.username;
  }
}