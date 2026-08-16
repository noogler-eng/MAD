// 621. Task Scheduler
#include<iostream>
using namespace std;

class Solution {
public:
    int leastInterval(vector<char>& tasks, int n) {
        unordered_map<char, int> m;
        priority_queue<pair<int, int>> pq_max;
        for(int i=0; i<tasks.size(); i++) m[tasks[i]]++;
        for(auto i: m) pq_max.push({i.second, i.first});
        
        int between = (pq_max.top().first - 1);
        int no_of_idle_possible = between * n;
        pq_max.pop();

        while(!pq_max.empty()){
            int no_of_item_to_be_placed = pq_max.top().first;
            if(no_of_idle_possible != 0) no_of_idle_possible -= min(no_of_idle_possible, min(no_of_item_to_be_placed, between));
            pq_max.pop();
        }

        return tasks.size() + no_of_idle_possible;
    }
};