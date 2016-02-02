'use strict';
import splay = require('./splay');
import treevent = require('./treevent');

let people = {
  'p1id': {
    name: 'Person 1',
    email: 'p1@example.com',
    subjects: [1, 2, 3],
  },
  'p2id': {
    name: 'Person 2',
    email: 'p2@example.com',
    subjects: [1, 3, 5],
  }
}
treevent.Wrap(people);


treevent.Listen(people, "**",  (path, params, type, index, oldValue, newValue) => {
  let ppath = path.join('.');
  switch (type) {
    case "create":
      console.log("%s>\tCreated: %s", ppath, JSON.stringify(newValue));
      break;
    case "delete":
      console.log("%s>\tRemoved", ppath);
      break;
    case "update":
      console.log("%s>\tUpdated: from %s to %s", ppath, JSON.stringify(oldValue), JSON.stringify(newValue));
      break;
  }
});

treevent.Listen(people, "{id}.email", (path, params, type, index, oldValue, newValue) => {
  console.log(`${params.id} updated their email to ${newValue}`)
});
