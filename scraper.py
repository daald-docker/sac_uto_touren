import os

#import dukpy
#jsi = dukpy.JSInterpreter()
#jsi.loader.register_path('./node_modules')
#dukpy.install_jspackage('async', None, './node_modules')
#dukpy.install_jspackage('cheerio', None, './node_modules')
#dukpy.install_jspackage('request', None, './node_modules')
#dukpy.install_jspackage('sqlite3', None, './node_modules')

os.system('wget --progress=dot:mega https://nodejs.org/dist/v16.13.1/node-v16.13.1-linux-x64.tar.xz')
os.system('tar xJf node-v16.13.1-linux-x64.tar.xz')
print('wrapper: downloading done.')
os.environ['PATH'] = os.getcwd() + '/node-v16.13.1-linux-x64/bin/:' + os.environ['PATH']
os.rename('package_orig.json', 'package.json')
os.system('npm install')
print('wrapper: installing done.')
os.system('node scraper_orig.js')
print('wrapper: all done.')
