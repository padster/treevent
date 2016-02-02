# Treevent JS

DOM elements have a tree heirarchy, and events that bubble along it - useful for correct scoping and composition.  
Javascript objects have a tree heirarchy, but...no events, outside of Object.observe, and no bubbling!

Some libraries try to provide equivalents, for example:
* [Polymer](http://polymer.github.io/polymer/) has notifyPath and its family of methods.
* [Falcor](https://netflix.github.io/falcor/documentation/paths.html) has quite good Path support.

... and most data binding frameworks ([React](https://facebook.github.io/react/), [Angular](https://angularjs.org/), [DoneJS](http://donejs.com/) etc.) support binding to paths but not necessarily good update logic.

#### API

Tree event tries to bridge that gap by offering an API which:
* Works with basic Javascript objects
* Provides an event bubbling and listening system similar to the DOM's
* Does Arrays properly<sup>*</sup>

How does it look? Try:
```javascript
myObject = {key: {val: 1, list: [0, {selected: true}]}};
Treevent.Wrap(myObject);
myObject.key.list[1].selected = false;
/* Raises events bubbling up the tree:
'selected', true => false
'1.selected', true => false
'list.1.selected', true => false
'key.list.1.selected', true => false
*/
```

... more coming once this is complete.

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
