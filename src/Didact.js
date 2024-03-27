/* global document */
import { createElement } from './createElement.js';
import { render, useState } from './render.js';

const Didact = {
  createElement,
  render,
  useState,
};

/** @jsx Didact.createElement */
function Counter() {
  const [state, setState] = Didact.useState(1);
  return Didact.createElement(
    'h1',
    {
      onClick: () => setState(c => c + 1),
      style: 'user-select: none',
    },
    'Count: ' + state,
  );
  // return (
  //     <h1 onClick={() => setState(c => c + 1)} style="user-select: none">
  //       Count: {state}
  //     </h1>
  // );
}

// const element = <Counter />;
const element = Didact.createElement(Counter);
const container = document.getElementById('root');
Didact.render(element, container);
