# command line interface - CLI
# opposite of GUI (graphical user interface)

# File management
# Control development environment
# Automate tasks

# The file tree
# Create and delete
# Write and read

# Copy, move, rename
# Search & replace
# Count & organise

clear

pwd
ls
ls -la
cd <folder_name>
cd ..

mkdir <folder_name>
touch <file_name>
rm -rf <folder_name>

nano <file_name>
cat <file_name>
cp <file_name> <new_file_name>
cp -r <folder_name> <new_folder_name>
# renaming, moving, and copying files
mv <file_name> <new_file_name> / <new_folder_name>
rm <file_name>

nano ~/.zshrc
source ~/.zshrc

chmod +x <file_name>

echo "Hello World" 
# redirection operator >
# echo creates new file if it doesn't exist
# > overwrites existing file
# >> appends to existing file
echo "Hello World" > <file_name>
echo "Hello World" >> <file_name>


# Terminalogy
# Local setup
# Find, search and replace
# Rename, move and copy
# Count and sort

# Linux, Shell and Commandline
# Linux - operating system, communication between hardware and software

# Shell - interface between user and operating system, command interpreter
# a programs that lets you interact with the operating system using commands
# several types of shells - bash, zsh, fish, etc.

# Commandline - text based interface to interact with the shell
# the concept of interacting with the shell using commands, rather than a GUI
# display inside the terminal, where you can type commands and see the output

# Termainl app ---> CLI -----> Shell -----> OS -----> Hardware

# which shell am I using?
echo $0


# options
# -r is option for recursive
rm -r <dir_name> 
# -l is option for long listing format
ls -l

# single -, double --, and no - options
# single - is for short options, can be combined
# double -- is for long options, cannot be combined
# no - is for commands that don't have options


# general
find [path] [option] [expression]
find . -name "forest*"
# case sensitive search
find . -iname "forest*"
# search by type (d - directory, f - file)
find . -type d -name "forest*"
find . -type f -name "forest*"
# combine options
find . -type f -iname "forest*" -size +1M

# paths
# relative - reltaive to current working directory
../<dir_name>
# absolute - from root directory
/Users/<user_name>/<dir_name>
# current directory
.
# parent directory
..
# Home directory
~
# root directory
/


# grep search
# gives all the instances of a pattern in a file
grep [pattern] [file_names]
grep "forest" <file_name>
grep [options] [pattern] [file_names]
# -i is option for case insensitive search
grep -i "forest" <file_name>
# -n is option for line number
grep -n "forest" <file_name>
# -r is option for recursive search
grep -n -r "forest" <dir_name>
grep -r "," '.'

# Kill a process
ps aux | grep <process_name>
kill <pid>


# replace one pattern with another in a file
sed 's/<pattern>/<replacement>/' <file_name>
sed 's/,/:/' <file_name>

sed 's/<pattern>/<replacement>/[options]' <file_name>
# global replacement, search case insensitive
sed 's/<pattern>/<replacement>/gI' <file_name>
sed 's/a/z/gI' <file_name>


# word count
wc <file_name>
wc -l <file_name> # line count
wc -w <file_name> # word count
wc -c <file_name> # character count