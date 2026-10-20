import { byId } from '../utils/dom.js';

const VIEWS = {
  employees: { sectionId: 'employees-view', buttonId: 'nav-employees-button' },
  dashboard: { sectionId: 'dashboard-view', buttonId: 'nav-dashboard-button' },
};

export function showView(viewName) {
  Object.entries(VIEWS).forEach(([name, { sectionId, buttonId }]) => {
    byId(sectionId).hidden = name !== viewName;
    byId(buttonId).classList.toggle('is-active', name === viewName);
  });
}
