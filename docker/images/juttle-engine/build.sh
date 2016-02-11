#!/bin/bash

# Copy the example juttle files to a local directory so the COPY
# command in the Dockerfile will work--you can't specify source files
# to a COPY command that are not in the current directory.

SUBDIR=example-docker-files

rm -rf $SUBDIR
mkdir $SUBDIR/
for dir in ../../../examples/*; do
    if [ -d $dir ]
    then
       echo "Copying example programs from $dir..."
       mkdir $SUBDIR/`basename $dir`
       cp $dir/*.juttle $SUBDIR/`basename $dir`
    fi
done
cp ../../../examples/index.juttle $SUBDIR

docker build -t juttle/juttle-engine .

# Remove the temporary directory
rm -rf $SUBDIR


