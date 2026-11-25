import { Profile, Branch, Shift, Department } from './database';
import { ScreenPermissionKey, ActionPermissionKey, UserPermissions } from './permissions';

export interface AuthSession {
  profile: Profile;
  branch: Branch;
  permissions: UserPermissions;
  activeShift: Shift | null;
  departments: Department[];
}

export interface MockUserPersona {
  id: string;
  username: string;
  full_name: string;
  job_title: string;
  permissions: {
    screens: ScreenPermissionKey[];
    actions: ActionPermissionKey[];
    departmentIds: string[];
  };
}
