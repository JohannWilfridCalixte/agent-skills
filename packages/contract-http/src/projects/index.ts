import { z } from 'zod';

export const Project = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().min(1),
  /** Absolute folder path on the server's machine. */
  path: z.string().min(1),
});

export type Project = z.infer<typeof Project>;

export const ProjectList = z.object({
  projects: z.array(Project),
});

export type ProjectList = z.infer<typeof ProjectList>;

/** `POST /api/projects`: the folder to register; the server validates it is absolute, exists and is a directory. */
export const AddProjectRequest = z.object({
  path: z.string().min(1),
});

export type AddProjectRequest = z.infer<typeof AddProjectRequest>;
