'use strict';
import splay = require('./splay');
import treevent = require('./treevent');

/***********
Example:
List aggregation 
***********/

let student = {
  scores: [1, 6, -3],
  totalScore: 0,
}
student.totalScore = student.scores.reduce((a, b) => a + b),


treevent.Listen(student, "scores", (path, params, type, index, oldValue, newValue) => {
  student.totalScore += (newValue | 0) - (oldValue | 0);
  // Will log 14 (10 introduced), then 8 (6 removed), then 3 (1 replaced with -4).
  console.log(`...sum is now ${student.totalScore}`);
});
student.scores.unshift(10);
student.scores.splice(1, 2, -4);
// NOTE: Object changes are processed asynchronously!
console.log(`Sync > Student score is: ${student.totalScore}`) // 4
requestAnimationFrame(() => console.log(`Async> Student score is: ${student.totalScore}`)); // 3


/***********
Example:
Data-store 
***********/
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

// Log whenever someone changes their email:
treevent.Listen(people, "{id}.email", (path, params, type, index, oldValue, newValue) => {
  console.log(`${params.id} updated their email to ${newValue}`)
});

// Log all changes:
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


