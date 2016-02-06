'use strict';
import splay = require('./splay');
import treevent = require('./treevent');
import utils = require('./utils');


/***********
Test:
Child editing at different levels.
***********
let parent = {
  child: {
    value: "x"
  }
}

let newValues = [];
treevent.Listen(parent, "child.value", (path, params, type, index, oldValue, newValue) => {
  newValues.push(newValue);
});
Exec(() => parent.child.value = "y");
Exec(() => parent.child = {value: "z"});
Exec(() => parent.child.value = "z");
Exec(() => parent.child = {value: "z"});
Exec(() => parent.child.value = "?");
Exec(() => parent.child = {value: "!"});
Exec(() => { 
  if (newValues.join('.') == "y.z.?.!") {
    console.log("Deep edits working!");
  } else {
    console.error("Deep child edits failed! Ended up with: %O", newValues);
  }
});

/***********
Test:
List aggregation 
***********
let todoList = {
  name: "My list",
  tasks: [
    {days: 1, done: true },
    {days: 4, done: false},
    {days: 3, done: false},
    {days: 1, done: false},
  ]
};
let tasksRemainingHistory = [];
let tasksRemaining = todoList.tasks.reduce( (a, b) => a + (!b.done ? 1 : 0), 0);
tasksRemainingHistory.push(tasksRemaining); // [3], dones = TFFF

treevent.Listen(todoList, "tasks[{id}].done", (path, params, type, index, oldValue, newValue) => {
  if (newValue === false) {
    tasksRemaining++; // Either created or updated.
  } else if (oldValue === false) {
    tasksRemaining--; // Either deleted or updated.
  }
  tasksRemainingHistory.push(tasksRemaining);
});

Exec(() => todoList.tasks[2].done = true); // [3, 2], dones = TFTF
Exec(() => todoList.tasks.unshift({days: 3, done: true})); // [3, 2, 2], dones = TTFTF
Exec(() => todoList.tasks.splice(1, 2)); // [3, 2, 2, 1, 1] dones = TTF
Exec(() => todoList.tasks.push({days: 5, done: false})); // [3, 2, 2, 1, 2], dones = TTFF
Exec(() => todoList.tasks.splice(1, 2, {days: 2, done: false}, {days: 2, done: false}, {days: 9, done: false})); // [3, 2, 2, 1, 2, 3, 4], dones = TFFFF

Exec(() => {
  if (tasksRemainingHistory.join('.') == '3.2.2.1.1.2.3.4') {
    console.log("Array deep edits working!");
  } else {
    console.error("Array child deep edits failed! Ended up with %O", tasksRemainingHistory);
  }
});


/***********
Interactive example:
Live array maps
***********/
let todoList = {
  tasks: [
    {days: 1, done: true },
    {days: 4, done: false},
    {days: 3, done: false},
    {days: 1, done: false},
  ]
};

let result = utils.LiveMap(todoList.tasks, task => !task.done ? task.days : 0);
let holder = {sum: result.reduce((a, b) => a + b)};
console.log("Initial sum = " + holder.sum);
treevent.Listen(result, "{id}", (path, params, type, index, oldValue, newValue) => {
  console.log("Single task: %d -> %d", oldValue || 0, newValue || 0);
  holder.sum += (newValue || 0) - (oldValue || 0);
});
treevent.Listen(holder, "sum", (path, params, type, index, oldValue, newValue) => {
  console.log("Sum: %d -> %d", oldValue, newValue);
});
Exec(() => todoList.tasks.push({days: 3, done: true}));
Exec(() => todoList.tasks[1].done = true);

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



function Exec(f): void {
  requestAnimationFrame(f);
}

