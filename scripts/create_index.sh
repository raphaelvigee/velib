#!/bin/bash

set -e

ROOT=${1}

if [ -z ${ROOT} ]; then 
	echo "Root is missing"
	exit
fi

FILES="${ROOT}/*"
INDEX_FILENAME="index.txt"
INDEX_PATH="${ROOT}/${INDEX_FILENAME}"

containsElement () {
  local e match="$1"
  shift
  for e; do [[ "$e" == "$match" ]] && return 0; done
  return 1
}

touch "${INDEX_PATH}"
echo -n > "${INDEX_PATH}" # Empty file

for file in $FILES
do
  FILENAME="${file##*/}"

  echo "Processing ${FILENAME}..."

  if [ "${FILENAME}" == "${INDEX_FILENAME}" ]; then
    echo "Ignored"
		continue
  fi

  if [ "${FILENAME}" == "stations.json" ]; then
    echo "Ignored"
		continue
  fi

  echo "Adding to index"

  echo "${FILENAME}" >> "${INDEX_PATH}"
done
