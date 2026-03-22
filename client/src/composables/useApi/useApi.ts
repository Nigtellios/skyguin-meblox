import type {
  ComponentGroup,
  FurnitureObject,
  HistoryEntry,
  MaterialLayer,
  MaterialTemplate,
  ObjectRelation,
  Project,
} from "../../types";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---- Projects ----
export const api = {
  projects: {
    list: () => request<Project[]>("/projects"),
    create: (data: Partial<Project>) =>
      request<Project>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Project>) =>
      request<Project>(`/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/projects/${id}`, { method: "DELETE" }),
    duplicate: (id: string) =>
      request<Project>(`/projects/${id}/duplicate`, { method: "POST" }),
  },

  objects: {
    list: (projectId: string) =>
      request<FurnitureObject[]>(`/projects/${projectId}/objects`),
    create: (projectId: string, data: Partial<FurnitureObject>) =>
      request<FurnitureObject>(`/projects/${projectId}/objects`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (projectId: string, id: string, data: Partial<FurnitureObject>) =>
      request<FurnitureObject>(`/projects/${projectId}/objects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updateBatch: (
      projectId: string,
      updates: Array<Partial<FurnitureObject> & { id: string }>,
    ) =>
      request<{ success: boolean }>(`/projects/${projectId}/objects/batch`, {
        method: "PUT",
        body: JSON.stringify(updates),
      }),
    delete: (projectId: string, id: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/objects/${id}`, {
        method: "DELETE",
      }),
    duplicate: (
      projectId: string,
      id: string,
      offset?: { offset_x?: number; offset_z?: number },
    ) =>
      request<FurnitureObject>(
        `/projects/${projectId}/objects/${id}/duplicate`,
        {
          method: "POST",
          body: JSON.stringify(offset || {}),
        },
      ),
  },

  components: {
    list: (projectId: string) =>
      request<ComponentGroup[]>(`/projects/${projectId}/components`),
    create: (projectId: string, data: { name: string; object_ids: string[] }) =>
      request<ComponentGroup>(`/projects/${projectId}/components`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, id: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/components/${id}`, {
        method: "DELETE",
      }),
    sync: (
      projectId: string,
      id: string,
      data: Partial<
        Pick<
          FurnitureObject,
          "width" | "height" | "depth" | "color" | "material_template_id"
        >
      >,
    ) =>
      request<FurnitureObject[]>(
        `/projects/${projectId}/components/${id}/sync`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
  },

  relations: {
    list: (projectId: string) =>
      request<ObjectRelation[]>(`/projects/${projectId}/relations`),
    create: (projectId: string, data: Partial<ObjectRelation>) =>
      request<ObjectRelation>(`/projects/${projectId}/relations`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, id: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/relations/${id}`, {
        method: "DELETE",
      }),
  },

  materials: {
    list: () => request<MaterialTemplate[]>("/material-templates"),
    create: (data: Partial<MaterialTemplate>) =>
      request<MaterialTemplate>("/material-templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<MaterialTemplate>) =>
      request<MaterialTemplate>(`/material-templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/material-templates/${id}`, {
        method: "DELETE",
      }),

    layers: {
      create: (
        templateId: string,
        data: Omit<Partial<MaterialLayer>, "is_bilateral"> & {
          is_bilateral?: boolean;
        },
      ) =>
        request<MaterialLayer[]>(`/material-templates/${templateId}/layers`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      update: (
        templateId: string,
        layerId: string,
        data: Partial<MaterialLayer>,
      ) =>
        request<MaterialLayer[]>(
          `/material-templates/${templateId}/layers/${layerId}`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          },
        ),
      delete: (templateId: string, layerId: string) =>
        request<{ success: boolean }>(
          `/material-templates/${templateId}/layers/${layerId}`,
          {
            method: "DELETE",
          },
        ),
    },
  },

  history: {
    list: (projectId: string) =>
      request<HistoryEntry[]>(`/projects/${projectId}/history`),
    add: (
      projectId: string,
      data: {
        action_type: string;
        action_label: string;
        snapshot: string;
        trim_after_id?: string;
      },
    ) =>
      request<HistoryEntry>(`/projects/${projectId}/history`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    revert: (projectId: string, historyId: string) =>
      request<{ success: boolean; objects: FurnitureObject[] }>(
        `/projects/${projectId}/history/${historyId}/revert`,
        { method: "POST" },
      ),
    navigate: (projectId: string, historyId: string) =>
      request<{ success: boolean; objects: FurnitureObject[] }>(
        `/projects/${projectId}/history/${historyId}/navigate`,
        { method: "POST" },
      ),
  },
};
