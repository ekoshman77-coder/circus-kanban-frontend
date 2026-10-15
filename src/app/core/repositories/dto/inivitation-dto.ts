export interface InviteRequestDto{
    departmentIds: string[],
    departmentRoles: string[]
}

export interface SearchUserDto{
    id: string,
    firstName: string,
    lastName: string
}