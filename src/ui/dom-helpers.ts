/**
 * Common DOM utility functions to reduce code duplication across UI modules.
 */

export function getElement(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function query(selector: string, parent?: Element): HTMLElement | null {
  return parent ? parent.querySelector(selector) : document.querySelector(selector);
}

export function queryAll(selector: string, parent?: Element): HTMLElement[] {
  return Array.from(parent ? parent.querySelectorAll(selector) : document.querySelectorAll(selector));
}

export function createElement(tag: string, className?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

export function append(parent: Element, child: Element): void {
  parent.appendChild(child);
}

export function insertHTML(parent: Element, position: InsertPosition, html: string): void {
  parent.insertAdjacentHTML(position, html);
}

export function remove(el: HTMLElement): void {
  el.remove();
}

export function setHidden(el: HTMLElement, hidden: boolean): void {
  el.style.display = hidden ? "none" : "";
}

export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setHtml(el: HTMLElement, html: string): void {
  if (el.innerHTML !== html) el.innerHTML = html;
}

export function setStyle(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

export function getStyleProperty(el: HTMLElement, property: keyof CSSStyleDeclaration): string {
  return el.style[property] as string;
}

export function setCssText(el: HTMLElement, cssText: string): void {
  el.style.cssText = cssText;
}

export function setCssVar(el: HTMLElement, name: string, value: string): void {
  el.style.setProperty(name, value);
}

export function toggleClass(el: Element, className: string, force?: boolean): void {
  el.classList.toggle(className, force);
}

export function onClick(el: EventTarget, handler: EventListener): void {
  el.addEventListener("click", handler);
}

export function onKeydown(el: EventTarget, handler: EventListener): void {
  el.addEventListener("keydown", handler);
}

export function onInput(el: EventTarget, handler: EventListener): void {
  el.addEventListener("input", handler);
}

export function onChange(el: EventTarget, handler: EventListener): void {
  el.addEventListener("change", handler);
}

export function onMouseDown(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mousedown", handler);
}

export function onMouseEnter(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mouseenter", handler);
}

export function onMouseLeave(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mouseleave", handler);
}

export function onMouseOver(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mouseover", handler);
}

export function onMouseOut(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mouseout", handler);
}

export function onMouseMove(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mousemove", handler);
}

export function onContextMenu(el: EventTarget, handler: EventListener): void {
  el.addEventListener("contextmenu", handler);
}

export function getBounds(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

export function onWindowResize(handler: EventListener): () => void {
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
}

export function onWindowKeydown(handler: EventListener): () => void {
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

export function onDocumentMousedown(handler: EventListener): () => void {
  document.addEventListener("mousedown", handler, true);
  return () => document.removeEventListener("mousedown", handler, true);
}

export function onDocumentClick(handler: EventListener): () => void {
  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}

export function onPointerDown(el: EventTarget, handler: EventListener): void {
  el.addEventListener("pointerdown", handler);
}

export function onWindowPointerMove(handler: EventListener): () => void {
  window.addEventListener("pointermove", handler);
  return () => window.removeEventListener("pointermove", handler);
}

export function onWindowPointerUp(handler: EventListener): () => void {
  window.addEventListener("pointerup", handler);
  return () => window.removeEventListener("pointerup", handler);
}

export function onWindowPointerCancel(handler: EventListener): () => void {
  window.addEventListener("pointercancel", handler);
  return () => window.removeEventListener("pointercancel", handler);
}

/** Set left/top without object allocation — for hot paths like drag ghosts. */
export function setPosition(el: HTMLElement, left: string, top: string): void {
  el.style.left = left;
  el.style.top = top;
}
