// 74. Search a 2D Matrix
#include<iostream>
using namespace std;

class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        int rows = matrix.size();
        int cols = matrix[0].size() - 1;
        int start_row = 0;
        
        while(start_row < rows && cols >= 0){
            if(matrix[start_row][cols] == target) return true;
            else if(matrix[start_row][cols] < target) start_row++;
            else cols--;
        }

        return false;
    }
};