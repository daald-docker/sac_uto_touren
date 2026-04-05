system("python3 --version")
#system("pip3 --version")
system("wget", "-q", "https://bootstrap.pypa.io/pip/3.6/get-pip.py")
system("python3 get-pip.py")
system("/app/.local/bin/pip --version")
system("git clone https://github.com/daald-docker/sac_uto_touren.git --single-branch --branch main-python scraper-py")
Dir.chdir("scraper-py") do
  #system("git branch -a")
  #system("git remote -v")
  system("/app/.local/bin/pip install -r requirements.txt")
  #system("find / -name pip -executable -type f")
end
