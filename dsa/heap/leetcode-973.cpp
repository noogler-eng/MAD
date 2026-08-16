// 973. K Closest Points to Origin
#include<iostream>
#include<math.h>
using namespace std;

class Solution {
public:
    vector<vector<int>> kClosest(vector<vector<int>>& points, int k) {
        priority_queue<pair<int, pair<int, int>>> pq_max;
        for(int i=0; i<points.size(); i++){
            int x = points[i][0];
            int y = points[i][1];
            pq_max.push({(x * x) + (y * y), {x, y}});
            if(pq_max.size() > k) pq_max.pop();
        }

        vector<vector<int>> ans;
        while(!pq_max.empty()){
            vector<int> vec_ans = {pq_max.top().second.first, pq_max.top().second.second};
            ans.push_back(vec_ans);
            pq_max.pop();
        }

        return ans;
    }
};