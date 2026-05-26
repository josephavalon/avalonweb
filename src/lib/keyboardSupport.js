export function activateOnKeyboard(event, callback) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  callback?.(event);
}

export const keyboardSurfaceContracts = {
  menu: { tabIndex: 0, onKeyDown: activateOnKeyboard },
  drawer: { tabIndex: -1, onKeyDown: activateOnKeyboard },
  command: { tabIndex: 0, onKeyDown: activateOnKeyboard },
  carousel: { tabIndex: 0, onKeyDown: activateOnKeyboard, onKeyUp: activateOnKeyboard },
  tablist: { tabIndex: 0, onKeyDown: activateOnKeyboard },
  toolbar: { tabIndex: 0, onKeyDown: activateOnKeyboard },
  sheet: { tabIndex: -1, onKeyDown: activateOnKeyboard },
};
