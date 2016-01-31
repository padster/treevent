export class Tree {
  root: Node;
  nodeMap: {[key:string]: Node};

  constructor() {
    this.root = null;
    this.nodeMap = {};
  }

  get length(): number {
    return this.root == null ? 0 : this.root.size;
  }

  insertBefore(index: number, key: string) {
    if (index < 0 || index > this.length) {
      console.error("Bad index: " + index);
    }
    let toInsert = new Node(key);
    this.nodeMap[key] = toInsert;

    if (this.root == null) {
      this.root = toInsert;
      return;
    }


    if (index == this.length) {
      this.nodeAtIndex(index - 1).insertRght(this, toInsert);
    } else {
      let atPosition = this.nodeAtIndex(index);
      if (atPosition.leftChild == null) {
        atPosition.insertLeft(this, toInsert);
      } else {
        atPosition = atPosition.leftChild;
        while (atPosition.rghtChild != null) {
          atPosition = atPosition.rghtChild;
        }
        atPosition.insertRght(this, toInsert);
      }
    }
  }

  remove(index: number) {
    let toRemove = this.nodeAtIndex(index);
    toRemove.remove(this);
    delete this.nodeMap[toRemove.key];
  }

  nodeAtIndex(index: number): Node {
    return this.root.nodeAtIndex(index);
  }

  indexForKey(key: string): number {
    return this.nodeMap.hasOwnProperty(key) ? this.nodeMap[key].treeIndex() : -1;
  }

  keyForIndex(index: number): string {
    if (index < 0 || index >= this.length) {
      return null;
    }
    return this.nodeAtIndex(index).key;
  }

  push(key: string) {
    this.insertBefore(this.length, key);
  }

  newRoot(node: Node) {
    this.root = node;
  }

  format(): string {
    return this.root == null ? "()" : this.root.format();
  }
}

class Node {
  key: string;
  size: number;
  
  parent: Node;
  leftChild: Node;
  rghtChild: Node;

  constructor(key: string) {
    this.key = key;
    this.size = 1;
    this.parent = null;
    this.leftChild = null;
    this.rghtChild = null;
  }

  collectKeys(keys: Array<string>) {
    this.leftChild && this.leftChild.collectKeys(keys);
    keys.push(this.key);
    this.rghtChild && this.rghtChild.collectKeys(keys);
  }

  isLeftChild(): boolean {
    return this.parent && this.parent.leftChild == this;
  }
  isRghtChild(): boolean {
    return this.parent && this.parent.rghtChild == this;
  }

  fixParentSizes(delta: number) {
    for (let at = this.parent; at != null; at = at.parent) {
      at.size += delta;
    }
  }

  replaceWithOnlyChild(tree: Tree) {
    this.fixParentSizes(-1);
    let replacement = this.leftChild == null ? this.rghtChild : this.leftChild;
    if (this.isLeftChild()) {
      this.parent.leftChild = replacement;
    } else {
      this.parent.rghtChild = replacement;
    }
  }

  replaceWith(tree: Tree, other: Node) {
    if (!this.parent) {
      tree.newRoot(other);
    } else {
      let oSize = other == null ? 0 : other.size;
      if (other != null) {
        other.fixParentSizes(-oSize);
      }
      this.fixParentSizes(oSize - this.size);
      if (this.isLeftChild()) {
        this.parent.leftChild = other;
      } else {
        this.parent.rghtChild = other;
      }
    }
    if (other != null) {  
      other.parent = this.parent;
    }
    this.size = 1;
    this.leftChild = null;
    this.rghtChild = null;
  }

  nodeAtIndex(index: number): Node {
    let leftChildren = this.leftChild ? this.leftChild.size : 0;
    if (index < leftChildren) {
      return this.leftChild.nodeAtIndex(index);
    } else if (index == leftChildren) {
      return this;
    } else {
      return this.rghtChild.nodeAtIndex(index - leftChildren - 1);
    }
  }

  treeIndex(): number {
    let leftCount = (this.leftChild == null ? 0 : this.leftChild.size);
    return leftCount + (this.isRghtChild() ? this.parent.treeIndex() : 0);
  }

  // https://en.wikipedia.org/wiki/Splay_tree
  leftRotate(tree: Tree) {
    let child = this.rghtChild;
    if (child != null) {
      this.rghtChild = child.leftChild;
      if (child.leftChild) { child.leftChild.parent = this; }
      child.parent = this.parent;

      // New! In theory should work...
      child.size = this.size;
      this.size -= 1 + (child.rghtChild ? child.rghtChild.size : 0);
    }

    if (!this.parent) {
      tree.newRoot(child);
    } else if (this.isLeftChild()) {
      this.parent.leftChild = child;
    } else {
      this.parent.rghtChild = child;
    }
    if (child != null) {
      child.leftChild = this;
    }
    this.parent = child;
  }
  rghtRotate(tree: Tree) { // TODO - merge with leftRotate, using child[2];
    let child = this.leftChild;
    if (child != null) {
      this.leftChild = child.rghtChild;
      if (child.rghtChild) { child.rghtChild.parent = this; }
      child.parent = this.parent;

      // New! In theory should work...
      child.size = this.size;
      this.size -= 1 + (child.leftChild ? child.leftChild.size : 0);
    }

    if (!this.parent) {
      tree.newRoot(child);
    } else if (this.isRghtChild()) {
      this.parent.rghtChild = child;
    } else {
      this.parent.leftChild = child;
    }
    if (child != null) {
      child.rghtChild = this;
    }
    this.parent = child;
  }
  splay(t: Tree) {
    while (this.parent != null) {
      if (this.parent.parent == null) {
        if (this.isLeftChild()) this.parent.rghtRotate(t);
        else this.parent.leftRotate(t);
      } else if (this.isLeftChild() && this.parent.isLeftChild()) {
        this.parent.parent.rghtRotate(t);
        this.parent.rghtRotate(t);
      } else if (this.isRghtChild() && this.parent.isRghtChild()) {
        this.parent.parent.leftRotate(t);
        this.parent.leftRotate(t);
      } else if (this.isLeftChild() && this.parent.isRghtChild()) {
        this.parent.rghtRotate(t);
        this.parent.leftRotate(t);
      } else {
        this.parent.leftRotate(t);
        this.parent.rghtRotate(t);
      }
    }
  }

  insertLeft(t: Tree, child: Node) {
    this.leftChild = child;
    for (let at: Node = this; at != null; at = at.parent) {
      at.size += child.size;
    }
    child.parent = this;
    child.splay(t);
  }
  insertRght(t: Tree, child: Node) {
    this.rghtChild = child;
    for (let at: Node = this; at != null; at = at.parent) {
      at.size += child.size;
    }
    child.parent = this;
    child.splay(t);
  }

  remove(t: Tree) {
    // debugger;
    this.splay(t);
    if (this.leftChild == null) {
      this.replaceWith(t, this.rghtChild);
    } else if (this.rghtChild == null) {
      this.replaceWith(t, this.leftChild);
    } else {
      let other = this.rghtChild;
      while (other != null && other.leftChild != null) {
        other = other.leftChild;
      }
      other.replaceWithOnlyChild(t);
      other.size = this.size; // Already smaller by one after other was replaced.
      other.parent = this.parent;
      other.leftChild = this.leftChild;
      if (other.leftChild != null) {
        other.leftChild.parent = other;
      }
      if (other != this.rghtChild) {
        other.rghtChild = this.rghtChild;
      }
      if (other.rghtChild != null) {
        other.rghtChild.parent = other;
      }
      if (other.parent == null) {
        t.newRoot(other);
      }
    }
  }

  format(): string {
    let leftF = this.leftChild == null ? "" : "(" + this.leftChild.format() + ")";
    let rghtF = this.rghtChild == null ? "" : "(" + this.rghtChild.format() + ")";
    return leftF + " " + this.key + "[" + this.size + "] " + rghtF;
  }

}