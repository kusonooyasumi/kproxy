/**
 * Svelte action that calls a callback function when a click occurs outside of the node.
 *
 * Usage:
 * ```svelte
 * <div use:clickOutside={() => handleClickOutside()}>
 *   <!-- content -->
 * </div>
 * ```
 */

export function clickOutside(node: HTMLElement, callback: () => void) {
  const handleClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
      callback();
    }
  };

  document.addEventListener('click', handleClick, true);

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    },
    update(newCallback: () => void) {
      callback = newCallback;
    }
  };
}
