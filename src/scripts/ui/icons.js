/** Icon markup for templates built in JavaScript (the drawings live in assets/icons). */
const icon = (name) => `<span class="icon icon--${name}" aria-hidden="true"></span>`;

export const ICONS = {
  employees: icon('employees'),
  roles: icon('roles'),
  box: icon('box'),
  pen: icon('pen'),
  eye: icon('eye'),
  chevron: icon('chevron'),
};
