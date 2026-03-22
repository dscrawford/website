((js-mode
  . ((eval . (setq-local exec-path (cons (expand-file-name "node_modules/.bin" (project-root (project-current))) exec-path)))))
 (js-jsx-mode
  . ((eval . (setq-local exec-path (cons (expand-file-name "node_modules/.bin" (project-root (project-current))) exec-path))))))
