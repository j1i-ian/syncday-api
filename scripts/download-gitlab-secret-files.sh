#!/bin/bash

echo -n "Input your personal gitlab access token (Visit https://gitlab.com/-/profile/personal_access_tokens): "

read GITLAB_ACCESS_TOKEN;

if [[ -z "$GITLAB_ACCESS_TOKEN" ]]; then
    echo "Please input tokne correctly.";
    exit 1;
else

    SYNC_API_GITLAB_PROJECT_ID=44527987;

    # Secret file list
    curl -H "PRIVATE-TOKEN: $GITLAB_ACCESS_TOKEN" --silent "https://gitlab.com/api/v4/projects/$SYNC_API_GITLAB_PROJECT_ID/secure_files" | \
    jq -c '.[]' | \
    jq -c '[.id, .name] | @sh' | \
    tr -d \' | \
    tr -d \" | \
    while read object;
    do
        SECRET_FILE_ID=$(echo "${object[0]}" | cut -d ' ' -f1);
        SECRET_FILE_NAME=$(echo "${object[0]}" | cut -d ' ' -f2);

        curl -H "PRIVATE-TOKEN: $GITLAB_ACCESS_TOKEN" "https://gitlab.com/api/v4/projects/$SYNC_API_GITLAB_PROJECT_ID/secure_files/$SECRET_FILE_ID/download" > "$SECRET_FILE_NAME" ;
    done
fi