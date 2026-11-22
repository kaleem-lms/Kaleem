# A known-bad line the CI canary must always flag. If the rules fail to load, the
# scan of the real code would read "clean"; the canary turns that into a red job.
# Never run: the file only has to parse and trip the rules.
import subprocess


def run(cmd):
    subprocess.call(cmd, shell=True)
