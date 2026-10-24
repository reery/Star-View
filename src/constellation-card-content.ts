/** Instantiate the same static card content with unique, accessible IDs. */
export function appendConstellationContent(root: HTMLElement, prefix = ''): void {
  const template = document.getElementById('constellation-content-template') as HTMLTemplateElement
  const content = template.content.cloneNode(true) as DocumentFragment
  for (const node of content.querySelectorAll<HTMLElement>('[id]')) node.id = prefix + node.id
  for (const node of content.querySelectorAll<HTMLElement>('[for], [aria-controls], [aria-labelledby], [aria-describedby]')) {
    for (const attribute of ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby']) {
      const value = node.getAttribute(attribute)
      if (value) node.setAttribute(attribute, value.split(' ').map((id) => prefix + id).join(' '))
    }
  }
  root.append(content)
}
