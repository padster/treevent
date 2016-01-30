main.js: *.ts
	@tsc -m commonjs -t ES6 main.ts

run: main.js
	@node main.js

