"use strict";

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
        await new Promise((resolve, _) => gapi.load('client:auth2', resolve));
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
    async getFiles(folder, limit, pageToken, options) {
        options = options || {};
        // kind, webViewLink
        let response = await gapi.client.drive.files.list({
            fields: "nextPageToken, files(id, name, size, mimeType, modifiedTime, iconLink, thumbnailLink)",
            orderBy: options.orderBy || "modifiedTime desc",
            q: "trashed=false and '" + (folder || 'root') + "' in parents",
            pageSize: limit || 50,
            pageToken: pageToken,
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
    async delete(fileId) {
        return await gapi.client.drive.files.delete({
            fileId: fileId
        }).status == 204;
    }
    async getFileBlob(fileId) {
        let url = "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media";
        let headers = {'Authorization': 'Bearer ' + gapi.auth.getToken().access_token};
        let response = await fetch(url, {headers: new Headers(headers)});
        if (!response.ok) throw new Error(response.statusText);
        return await response.blob();
    }
}

// for test page
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

    let loadList = async function (folder) {
        let fileListEl = document.querySelector("#file_list");
        element_clear(fileListEl);

        (await drive.getFiles(folder, 100)).files.forEach(file => {
            let el = element("li", [element('img', [], { src: file.iconLink, crossorigin: "anonymous" }), `${file.name} (${file.mimeType})`]);
            element_append(fileListEl, el);
            el.addEventListener('click', ev => {
                console.log(file);
                if (file.mimeType == "application/vnd.google-apps.folder") {
                    location.hash = "#folder:" + file.id;
                } else if (file.thumbnailLink) {
                    document.querySelector("#thumb_image").src = file.thumbnailLink.replace(/=s\d+/, "=s2048");
                    (async () => {
                        console.log("file blob", await drive.getFileBlob(file.id));
                        let response = await fetch(file.thumbnailLink, { credentials: "same-origin", referrerPolicy: "origin-when-cross-origin" });
                        console.log(response);
                        if (response.ok) {
                            console.log("thumb blob", await response.blob());
                        }
                    })();
                }
            });
        });
    };

    document.querySelector("#signout").addEventListener('click', ev => {
        drive.signOut();
    });

    window.addEventListener('hashchange', ev => {
        ev.preventDefault();
        loadList((location.hash.match(/#folder:(.+)/) || [])[1] || 'root');
    });
    loadList((location.hash.match(/#folder:(.+)/) || [])[1] || 'root');
}
