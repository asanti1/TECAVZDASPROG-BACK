// La sesión vive en sessionStorage: se pierde al cerrar la pestaña.
const KEY = 'logistics.session';

export const session = {
  get() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY));
    } catch {
      return null;
    }
  },
  save(value) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* sin storage: la sesión dura hasta recargar */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* nada que borrar */
    }
  },
};
