export function getWorkspaceDocId(workspace, uid) {
    return workspace === 'personal' ? `personal_${uid}` : workspace;
}