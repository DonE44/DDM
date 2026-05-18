/** Keyboard shortcuts reference panel */
export default function ShortcutsPanel({ onClose }) {
  const groups = [
    { title: 'Playback', items: [
      ['F5', 'Play presentation'],
      ['Escape', 'Stop / close overlay · deselect all'],
    ]},
    { title: 'Edit', items: [
      ['Ctrl+Z', 'Undo'],
      ['Ctrl+Y / Ctrl+Shift+Z', 'Redo'],
      ['Ctrl+C', 'Copy selected'],
      ['Ctrl+V', 'Paste'],
      ['Ctrl+D', 'Duplicate'],
      ['Ctrl+A', 'Select all'],
      ['Escape', 'Deselect all (Select None)'],
      ['Delete / Backspace', 'Delete selected'],
    ]},
    { title: 'View & Panels', items: [
      ['Ctrl+1', 'Toggle Pages panel'],
      ['Ctrl+2', 'Toggle Properties panel'],
      ['Ctrl+3', 'Toggle Timeline'],
      ['Ctrl+G', 'Toggle grid'],
      ['Ctrl+T', 'Toggle timeline'],
      ['Ctrl+= / Ctrl++', 'Zoom in (+10%)'],
      ['Ctrl+-', 'Zoom out (−10%)'],
      ['Ctrl+0', 'Fit canvas to window'],
      ['Ctrl+?', 'This shortcuts panel'],
    ]},
    { title: 'Navigation', items: [
      ['Page Up', 'Previous page'],
      ['Page Down', 'Next page'],
      ['Arrow keys', 'Nudge element 1px'],
      ['Shift+Arrow', 'Nudge element 10px'],
    ]},
    { title: 'Layers', items: [
      ['Ctrl+]', 'Layer up'],
      ['Ctrl+[', 'Layer down'],
      ['Ctrl+Shift+]', 'Bring to front'],
      ['Ctrl+Shift+[', 'Send to back'],
    ]},
    { title: 'Tools (editor)', items: [
      ['V', 'Select tool'],
      ['T', 'Text tool'],
      ['I', 'Image/clip tool'],
      ['B', 'Button tool'],
      ['M', 'MPEG/video tool'],
      ['F9', 'Script view'],
    ]},
  ]

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <span>⌨ Keyboard Shortcuts</span>
          <button className="shortcuts-close" onClick={onClose}>✕</button>
        </div>
        <div className="shortcuts-body">
          {groups.map((g) => (
            <div key={g.title} className="shortcuts-group">
              <div className="shortcuts-group-title">{g.title}</div>
              <table className="shortcuts-table">
                <tbody>
                  {g.items.map(([key, desc]) => (
                    <tr key={key}>
                      <td className="sc-key"><kbd>{key}</kbd></td>
                      <td className="sc-desc">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
