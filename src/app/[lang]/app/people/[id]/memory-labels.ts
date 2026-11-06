import type { Dictionary } from "@/i18n/dictionaries";
import type { MemoryLabels } from "./MemoryCard";

/** The words an opened memory needs, from the dictionary. */
export function memoryLabels(t: Dictionary): MemoryLabels {
  const m = t.memories;
  return {
    read: m.read,
    close: t.add.close,
    enlarge: m.openPhoto,
    thanks: m.thanks,
    comments: m.comments,
    commentPh: m.commentPh,
    send: m.send,
    edit: m.edit,
    delete: m.delete,
    deleteConfirm: m.deleteConfirm,
    save: t.app.save,
    cancel: t.app.cancel,
    tagPerson: m.tagPerson,
    removePerson: m.removePerson,
    more: m.more,
    setup: m.setup,
    error: t.app.errorSave,
    prev: m.prev,
    next: m.next,
  };
}
