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

export function setCssText(el: HTMLElement, cssText: string): void {
  el.style.cssText = cssText;
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

export function onMouseEnter(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mouseenter", handler);
}

export function onMouseLeave(el: EventTarget, handler: EventListener): void {
  el.addEventListener("mouseleave", handler);
}

export function getBounds(el: Element): DOMRect {
  return el.getBoundingClientRect();
}
