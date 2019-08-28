
// <script src="js/googledrive.js"></script>
// <script src="https://apis.google.com/js/api.js?onload=gapiLoaded" async defer></script>

class GoogleDrive {
    constructor(clientId) {
        this.params = {
            'client_id': clientId,
            'scope': 'https://www.googleapis.com/auth/drive'
        };
    }
    async init(signIn = true) {
        await new Promise((resolve, reject) => {
            gapi.load('client:auth2', () => resolve(null));
        });
        let auth = await gapi.auth2.init(this.params);
        if (!auth.isSignedIn.get()) {
            if (!signIn) return false;
            await auth.signIn();
        }
        await gapi.client.load("drive", "v3");
        return true;
    }
    signOut() {
        gapi.auth2.getAuthInstance().signOut();
    }
    async getFiles(folder, limit) {
        // kind, webViewLink
        let response = await gapi.client.drive.files.list({
            fields: "nextPageToken, files(id, name, size, mimeType, modifiedTime, iconLink, thumbnailLink)",
            orderBy: "name,modifiedTime",
            q: "trashed=false and '" + (folder || 'root') + "' in parents",
            pageSize: limit || 50,
            spaces: "drive"
        });
        if (!response || response.status != 200) {
            return null;
        }
        // application/vnd.google-apps.folder
        return response.result;
    }
    async getFile(fileId) {
        let response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        if (!response || response.status != 200) {
            return null;
        }
        return response.body;
    }
    async create(name, content, mimeType, folder) {
        return await gapi.client.drive.files.create({
            name: name,
            parents: [folder || 'root'],
            uploadType: "media",
            fields: "id, name, parents",
            media: content,
            resource: { mimeType: mimeType }
        });
    }
    async delete(fileId, revId) {
        return await gapi.client.drive.files.delete({
            fileId: fileId,
            revisionId: revId
        });
    }
    getFileBlob(fileId) {
        return new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';
            xhr.open('GET', "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media");
            xhr.setRequestHeader('Authorization', 'Bearer ' + gapi.auth.getToken().access_token);
            xhr.onload = () => {
                xhr.status === 200 ? resolve(xhr.response) : reject(new Error(xhr.statusText));
            };
            xhr.onerror = () => {
                reject(new Error(xhr.statusText));
            };
            xhr.send();
        });
    }
}

async function loadList(drive, folder) {
    let fileListEl = document.querySelector("#file_list");
    element_clear(fileListEl);

    (await drive.getFiles(folder)).files.forEach(file => {
        let el = element("li", [element('img', [], { src: file.iconLink }), `${file.name} (${file.mimeType})`]);
        element_append(fileListEl, el);
        el.addEventListener('click', ev => {
            console.log(file);
            if (file.mimeType == "application/vnd.google-apps.folder") {
                location.hash = "#folder:" + file.id;
            } else {
                location.href = file.thumbnailLink.replace(/=s\d+/, "=s2048");
            }
        });
    });
}

async function gapiLoaded() {
    const clientIds = {
        "http://localhost:8080": "86954684848-e879qasd2bnnr4pcdiviu68q423gbq4m.apps.googleusercontent.com",
        "https://binzume.github.io": "86954684848-okobt1r6kedh2cskabcgmbbqe0baphjb.apps.googleusercontent.com"
    };
    let drive = new GoogleDrive(clientIds[location.origin]);
    if (!await drive.init()) {
        console.log("drive unavailable");
        return;
    }

    window.addEventListener('hashchange', ev => {
        ev.preventDefault();
        loadList(drive, (location.hash.match(/#folder:(.+)/) || [])[1] || 'root');
    });
    loadList(drive, (location.hash.match(/#folder:(.+)/) || [])[1] || 'root');
}
