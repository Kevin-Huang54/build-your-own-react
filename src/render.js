/* global document requestIdleCallback*/

// 创建真实dom
export function createDom(fiber) {
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? // 创建纯文字
        // nodeValue会作为属性传给纯文本节点，如<Text nodeValue="abc" />就相当于abc文本
        document.createTextNode('')
      : document.createElement(fiber.type); // 创建真实dom

  updateDom(dom, {}, fiber.props);

  return dom;

  // 对所有children递归调用
  // 该递归调用会阻塞浏览器，如果element树非常大，遇到用户输入等高优先级事件时就会发生卡顿，因此这行需要重构
  // element.props.children.forEach(child => render(child, dom));

  // 挂载到container节点，改用fiber架构之后不再调用该行
  // container.appendChild(dom);
}

// dom更新的算法
const isEvent = key => key.startsWith('on');
const isProperty = key => key !== 'children' && !isEvent(key);
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next); // 这里的key是哪里来的
function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });
  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = '';
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name];
    });
  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

// 这里我们递归地将所有节点追加到 dom 中。
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  // const domParent = fiber.parent.dom; // 针对fiber树中有dom属性的情况
  // First, to find the parent of a DOM node
  // we’ll need to go up the fiber tree until we find a fiber with a DOM node.
  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom); // 新增节点
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props); // 更新节点
  } else if (fiber.effectTag === 'DELETION') {
    // domParent.removeChild(fiber.dom); // 删除节点，针对有dom的情况
    commitDeletion(fiber, domParent);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    // And when removing a node we also need to keep going
    // until we find a child with a DOM node.
    commitDeletion(fiber.child, domParent);
  }
}

export function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

let nextUnitOfWork = null;
let currentRoot = null; // 上一次提交的fiber树
let wipRoot = null;
let deletions = null; // 需要删除的节点

function workLoop(deadline) {
  let shouldYield = false; // 是否需要输出结果
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1; // 在一次loop时间结束前反复调用，直到时间结束
  }
  if (!nextUnitOfWork && wipRoot) {
    commitRoot(); // 所有fiber全部构建完之后，才能提交
  }

  requestIdleCallback(workLoop); // 时间结束后，等待浏览器空闲后继续调用
}
requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  // First, we create a new node and append it to the DOM.
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  // if (!fiber.dom) {
  //   fiber.dom = createDom(fiber); // 创建真实dom，储存在dom属性
  // }

  // 浏览器可能会打断，使用户看到不完整的UI，因此这里要删除，转移到commitWork中
  // if (fiber.parent) {
  //   fiber.parent.dom.appendChild(fiber.dom); // 如果有父级，就挂载到父级
  // }

  // For each child we create a new fiber.
  // const elements = fiber.props.children;
  // reconcileChildren(fiber, elements);

  // 后面的代码用于返回下一个需要处理的节点
  if (fiber.child) {
    return fiber.child; // 如果有child，也就是第一个子项，就返回这个子项
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling; // 如果有下一个兄弟，就返回
    }
    nextFiber = nextFiber.parent; // 否则就返回父级，在下一个循环中可能会返回叔辈
  }
}

let wipFiber = null;
let hookIndex = null;
function updateFunctionComponent(fiber) {
  wipFiber = fiber; // the fiber in progress
  // to support calling useState several times in the same component
  hookIndex = 0;
  wipFiber.hooks = [];

  // For our example, here the fiber.type is the App function
  // and when we run it, it returns the h1 element.
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
  // Then, once we have the children,
  // the reconciliation works in the same way, we don’t need to change anything there.
}

export function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  // 我们在下次渲染组件时执行此操作，从旧的钩子队列中获取所有操作，
  // 然后将它们一一应用于新的钩子状态，因此当我们返回状态时，它会被更新。
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(action => {
    hook.state = action(hook.state);
  });
  const setState = action => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber); // 创建真实dom，储存在dom属性
  }
  reconcileChildren(fiber, fiber.props.children);
}

function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];

    let newFiber = null;
    // 为每一个child创建新的fiber节点，旧
    // const newFiber = {
    //   type: element.type,
    //   props: element.props,
    // parent: fiber, // 每个节点都储存了父节点的指针
    // dom: null, // dom尚未构建出来，等待下一次执行本函数时构建
    // };

    // compare oldFiber to element
    // The element is the thing we want to render to the DOM
    // and the oldFiber is what we rendered the last time.
    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // update the node
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE', // 打上标记
      };
    }
    if (element && !sameType) {
      //  add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT', // 打上标记
      };
    }
    if (oldFiber && !sameType) {
      //  delete the oldFiber's node
      oldFiber.effectTag = 'DELETION'; // 这里标签要添加到旧fiber上
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber; // 如果是children中的第一个子项，父级要储存这个子项的指针，参考fiber架构图
    } else if (element) {
      prevSibling.sibling = newFiber; // prevSibling是什么，没有看懂，而且也没有使用
    }

    prevSibling = newFiber;
    index++;
  }
}
