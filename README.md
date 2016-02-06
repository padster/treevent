# Treevent JS

DOM elements have a tree heirarchy, and events that bubble along it - useful for correct scoping and composition.  
Javascript objects have a tree heirarchy, but...no events, outside of Object.observe, and no bubbling!

Some libraries try to provide equivalents, for example:
* [Polymer](http://polymer.github.io/polymer/) has notifyPath and its family of methods.
* [Falcor](https://netflix.github.io/falcor/documentation/paths.html) has quite good Path support.

... and most data binding frameworks ([React](https://facebook.github.io/react/), [Angular](https://angularjs.org/), [DoneJS](http://donejs.com/) etc.) support binding to paths but not necessarily good update logic.

For now, uses typescript and ES6 (including destructuring) so please use recent V8 for now.

#### API

Tree event tries to bridge that gap by offering an API which:
* Works with basic Javascript objects
* Provides an event bubbling and listening system similar to the DOM's
* Does Arrays properly<sup>*</sup>

How does it look? Say you have an object representing a person with a list of scores. You may wish to keep track
of their overall score reactively, but re-summing each change is costly. Instead, consider:
```javascript
let student = {
  scores: [1, 6, -3],
  totalScore: 0,
};
student.totalScore = student.scores.reduce((a, b) => a + b),
treevent.Listen(student, "scores", (path, params, type, index, oldValue, newValue) => {
  student.totalScore += (newValue || 0) - (oldValue || 0);
  // Will log 14 (10 introduced), then 8 (6 removed), then 3 (1 replaced with -4).
  console.log(`...sum is now ${student.totalScore}`);
});
```

Another more useful example is when you have part of your data store represented as a tree of JS objects (like falcor). The following code sets up a contact store, then listens to just events raised when a user changes their email address:
```javascript
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
};

// Log whenever someone changes their email:
treevent.Listen(people, "{id}.email", (path, params, type, index, oldValue, newValue) => {
  console.log(`${params.id} updated their email to ${newValue}`)
});
```

As a third example of where the full features shine, take a more complex case: given a list of objects,
keep a live value that is the sum of one property across all of them, but only for those where a second property is true.
```javascript
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
// Now, changing a property within an object, or adding / removing ones from the array,
// will remap and update / add / remove the new value to result, which will then
// update the overall sum value stored automatically.
```


#### <sup>*</sup>'Proper' arrays
```javascript
myArray = ["Aaron", "Beth", "Darth"];
myArray.splice(2, 0, "Cate");
// What events should be raised?...
```

In many binding libraries, the above will cause three event changes:
* myArray[2] changes Darth -> Cate
* myArray[3] gets added as Darth
* myArray.length changes from 3 to 4.

However, if you're mapping your list into a list of elements (quite common), then most likely you instead want to know a value was inserted at [2], so you can add a mapped DOM element at the same place, to saving having to perform complex diff comparison to find out what has changed.

Similarly with lists, when bubbling events up, it shouldn't take O(n) to calculate the position of the source object in a list, nor should it take O(n) to update all the indexes on a list modification. Treevent performs both in O(log n), so list operations are still fast, and events can bubble with the correct index path.

**NOTE** due to the overhead, treevent should not be used with long lists (e.g. 200+). Lists that big probably shouldn't be used in UIs anyway, but just in case...don't use this to store long timeseries lists.


#### TODO
* Fix path matching to include prefixes - e.g. if 'task' is an array, "task[\*].complete" should fire when 'create'/'delete' is raised against task, or 'update' is raised against task[\*].
* Tests :)
* Proper node.js / module packaging etc.
* Faster indexed listener lookup
