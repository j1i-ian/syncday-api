#!/bin/bash

CLUSTER=${1:-syncday-api}
CONTAINER_NAME=${2:-syncday-api}

TASK_ID=$(aws ecs list-tasks --cluster $CLUSTER --desired-status 'RUNNING' --output text | awk -F "/" '{ print $3 }')

aws ecs execute-command --cluster $CLUSTER \
    --task $TASK_ID \
    --container $CONTAINER_NAME  \
    --interactive \
    --command "/bin/sh"
