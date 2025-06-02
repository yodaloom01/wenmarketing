const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    console.log(`Received request for: ${req.url}`);
    
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    console.log(`Attempting to serve: ${filePath}`);

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            console.error(`Error reading file ${filePath}:`, error);
            
            if(error.code === 'ENOENT') {
                res.writeHead(404);
                res.end(`File not found: ${filePath}`);
            } else {
                res.writeHead(500);
                res.end(`Server error: ${error.code}`);
            }
        } else {
            console.log(`Successfully serving ${filePath}`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const port = 3000;
server.listen(port, 'localhost', () => {
    console.log(`Server running at http://localhost:${port}/`);
    console.log('Current directory:', process.cwd());
    console.log('Files in directory:');
    fs.readdir('.', (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
        } else {
            files.forEach(file => console.log('- ' + file));
        }
    });
}); 