#include <iostream>
#include <map>

int main() {
    std::map<int, int> mp;

    // Insert some key-value pairs into the map
    mp[10000] = 1;
    mp[209009] = 200;
    mp[3809809] = 300;

    // Iterate over the map in reverse order
    for (auto it = mp.rbegin(); it != mp.rend(); ++it) {
        std::cout << "Key: " << it->first << ", Value: " << it->second << std::endl;
    }

    return 0;
}
